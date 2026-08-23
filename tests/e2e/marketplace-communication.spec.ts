import { expect, test, type Page } from '@playwright/test'

async function mockBrokerSession(page: Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'user-1', name: 'Corretora Real', email: 'corretora@example.com', role: 'BROKER', brokerId: 'broker-1', agencyId: null } } }))
  await page.route('**/api/brokers/me**', (route) => route.fulfill({ json: { profile: { id: 'user-1', brokerId: 'broker-1', agencyId: null, agencyName: '', accountType: 'BROKER_INDEPENDENT', name: 'Corretora Real', email: 'corretora@example.com', phone: '5554999999999', photoUrl: '', creci: '12345-F', description: '' } } }))
  await page.route('**/api/brokers/subscription**', (route) => route.fulfill({ json: { subscription: { planName: 'Plano EME', isUpgraded: true, propertyLimit: 10, status: 'Ativo' } } }))
}

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
}

const broker = {
  id: 'broker-1', slug: 'corretor-real', name: 'Corretora Real', creci: 'CRECI 12345-F', region: 'Centro', regionSlug: 'centro', specialties: ['Residencial'], bio: 'Atendimento consultivo.', phone: '5554999999999', image: '/marketplace/placeholder-user.jpg', activeListings: 2, rating: 4.8, reviewCount: 5, reviews: [], featured: false, verified: true, transaction: 'ambos', propertyTypes: [],
}

test.describe('Comunicação e descoberta do Marketplace', () => {
  test('filtros rápidos abrem fora da faixa rolável e aplicam valor, quartos e área', async ({ page }) => {
    await page.goto('/imoveis/busca')
    await page.getByRole('button', { name: 'Faixa de valor' }).click()
    const themedPopover = page.getByRole('dialog')
    await expect(themedPopover).toBeVisible()
    const popoverColors = await themedPopover.evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color }
    })
    expect(popoverColors.background).not.toBe('rgb(0, 0, 0)')
    expect(popoverColors.color).not.toBe('rgb(255, 255, 255)')
    await page.evaluate(() => window.scrollBy(0, 120))
    await expect(themedPopover).toBeHidden()
    await page.evaluate(() => window.scrollTo(0, 0))

    for (const label of ['Faixa de valor', 'Quartos', 'Área']) {
      await page.getByRole('button', { name: label }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: 'Quartos' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '3+' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('button', { name: '3+ quartos', exact: true })).toBeVisible()
  })

  test('pedido de ajuda pesquisa corretores e não usa envio demonstrativo', async ({ page }) => {
    await page.route('**/api/marketplace/broker-matches', (route) => route.fulfill({ json: { matches: [{ broker, score: 77, reasons: ['Atua em Centro', '2 imóveis ativos compatíveis'], compatibleListings: 2 }] } }))
    await page.goto('/imoveis/busca')
    await page.getByRole('button', { name: 'Quero ajuda para encontrar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Pesquisar corretores' })
    await dialog.getByLabel('Nome').fill('Cliente Teste')
    await dialog.getByLabel('Telefone/WhatsApp').fill('(54) 99999-9999')
    await dialog.getByLabel('Localização').fill('Centro')
    await dialog.getByLabel('Resumo da busca').fill('Apartamento com 2 quartos para comprar')
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Pesquisar corretores' }).click()
    await expect(dialog.getByText('Corretora Real')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Falar agora' })).toBeVisible()
  })

  test('área Marketplace do corretor usa perfil real e mantém conversas em mobile', async ({ page }) => {
    await mockBrokerSession(page)
    const messages = Array.from({ length: 36 }, (_, index) => ({
      id: `message-${index + 1}`,
      sender: index % 2 ? 'BROKER' : 'CUSTOMER',
      body: `Mensagem persistida ${index + 1} com conteúdo suficiente para validar a rolagem interna da conversa.`,
      createdAt: new Date(Date.now() + index * 1000).toISOString(),
    }))
    await page.route('**/api/brokers/marketplace', (route) => route.fulfill({ json: { profile: broker, settings: { slug: broker.slug, displayName: broker.name, photoUrl: broker.image, specialties: broker.specialties, region: broker.region, transactions: 'BOTH', bio: broker.bio }, publicPath: `/imoveis/corretores/${broker.slug}`, properties: [{ id: 'property-1', title: 'Apartamento real', marketplaceSlug: 'apartamento-real', purpose: 'SALE', price: 500000, city: 'Centro', image: '/marketplace/placeholder.svg' }], leads: [{ id: 'lead-1', name: 'Cliente Real', phone: '5554999999999', intent: 'Compra', status: 'NEW', createdAt: new Date().toISOString() }], counts: { conversations: 1, properties: 1, leads: 1, reviews: { PENDING_REVIEW: 1 } } } }))
    await page.route('**/api/brokers/marketplace/conversations', (route) => route.fulfill({ json: { conversations: [
      { id: 'conversation-1', customerName: 'Cliente Real', customerPhone: '5554999999999', status: 'OPEN', property: { title: 'Apartamento real' }, lastMessageAt: new Date().toISOString(), reviewRequestedAt: null, messages },
      { id: 'conversation-2', customerName: 'Cliente Encerrado', customerPhone: '5554888888888', status: 'CLOSED', property: { title: 'Casa encerrada' }, lastMessageAt: new Date().toISOString(), reviewRequestedAt: new Date().toISOString(), messages: [{ id: 'closed-message', sender: 'CUSTOMER', body: 'Atendimento finalizado.', createdAt: new Date().toISOString() }] },
    ] } }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/corretor/marketplace')
    await expect(page.getByRole('heading', { name: 'Seu atendimento público em um só lugar' })).toBeVisible()
    await expect(page.getByText('Corretora Real').first()).toBeVisible()
    const closedConversation = page.getByRole('button', { name: /Cliente Encerrado/ })
    await expect(closedConversation).toContainText('Encerrado')
    await expect(closedConversation).not.toContainText('Em atendimento')
    const composer = page.getByPlaceholder('Responder')
    await composer.scrollIntoViewIfNeeded()
    await expect(composer).toBeVisible()
    const conversationScroll = page.getByTestId('marketplace-conversation-scroll')
    const scrollLayout = await conversationScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      const composer = document.querySelector<HTMLInputElement>('input[placeholder="Responder"]')
      return {
        overflowY: getComputedStyle(element).overflowY,
        hasInternalOverflow: element.scrollHeight > element.clientHeight,
        composerBottom: composer?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        viewportHeight: window.innerHeight,
      }
    })
    expect(scrollLayout.overflowY).toBe('auto')
    expect(scrollLayout.hasInternalOverflow).toBe(true)
    expect(scrollLayout.composerBottom).toBeLessThanOrEqual(scrollLayout.viewportHeight)
    await expect(page.getByText('Mensagem persistida 36 com conteúdo suficiente para validar a rolagem interna da conversa.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver perfil público' })).toHaveAttribute('href', `/imoveis/corretores/${broker.slug}`)
    await expectNoHorizontalOverflow(page)
  })

  test('compositor do corretor compartilha apenas imóvel publicado e proposta compatível', async ({ page }) => {
    await mockBrokerSession(page)
    const messages: Array<{ id: string; sender: string; kind: string; body: string; metadata?: unknown; createdAt: string }> = [
      { id: 'message-1', sender: 'CUSTOMER', kind: 'TEXT', body: 'Pode me enviar as opções?', createdAt: new Date().toISOString() },
    ]
    const dashboard = { profile: broker, settings: { slug: broker.slug, displayName: broker.name, photoUrl: broker.image, specialties: broker.specialties, region: broker.region, transactions: 'BOTH', bio: broker.bio }, publicPath: `/imoveis/corretores/${broker.slug}`, properties: [], leads: [], counts: { conversations: 1, properties: 1, leads: 1, reviews: {} } }
    const conversations = () => [{ id: 'conversation-1', customerName: 'Cliente Real', customerPhone: '5554999999999', status: 'OPEN', property: { title: 'Apartamento publicado' }, lastMessageAt: new Date().toISOString(), reviewRequestedAt: null, messages }]
    await page.route('**/api/brokers/marketplace', (route) => route.fulfill({ json: dashboard }))
    await page.route('**/api/brokers/marketplace/conversations', (route) => route.fulfill({ json: { conversations: conversations() } }))
    await page.route('**/api/brokers/marketplace/conversations/conversation-1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: {
          properties: [{ id: 'property-1', title: 'Apartamento publicado', location: 'Centro, Vacaria', price: 50000000, image: '/marketplace/placeholder.svg', slug: 'apartamento-publicado' }],
          proposals: [{ id: 'proposal-1', title: 'Proposta Apartamento', status: 'generated', propertyTitle: 'Apartamento publicado', updatedAt: new Date().toISOString() }],
        } })
        return
      }
      const body = route.request().postDataJSON() as { kind?: string; referenceId?: string }
      if (body.kind === 'PROPERTY') messages.push({ id: 'message-property', sender: 'BROKER', kind: 'PROPERTY', body: 'Imóvel compartilhado', metadata: { title: 'Apartamento publicado', location: 'Centro, Vacaria', price: 50000000, image: '/marketplace/placeholder.svg', slug: 'apartamento-publicado' }, createdAt: new Date().toISOString() })
      if (body.kind === 'PROPOSAL') messages.push({ id: 'message-proposal', sender: 'BROKER', kind: 'PROPOSAL', body: 'Proposta compartilhada', metadata: { title: 'Proposta Apartamento', status: 'generated', propertyTitle: 'Apartamento publicado' }, createdAt: new Date().toISOString() })
      await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/corretor/marketplace')
    await page.getByRole('button', { name: 'Compartilhar na conversa' }).click()
    const popover = page.getByText('Compartilhar', { exact: true }).locator('..').locator('..')
    await expect(popover.getByRole('button', { name: /Enviar imóvel/ })).toBeVisible()
    await expect(popover.getByRole('button', { name: /Enviar proposta/ })).toBeVisible()
    await expect(popover.getByText(/contrato|documento|imagem/i)).toHaveCount(0)
    await popover.getByRole('button', { name: /Enviar imóvel/ }).click()
    await page.getByRole('button', { name: /Apartamento publicado Centro, Vacaria/ }).click()
    await expect(page.getByRole('link', { name: /Apartamento publicado/ })).toBeVisible()

    await page.getByRole('button', { name: 'Compartilhar na conversa' }).click()
    await page.getByRole('button', { name: /Enviar proposta/ }).click()
    await page.getByRole('button', { name: /Proposta Apartamento/ }).click()
    await expect(page.getByText('Proposta Apartamento').last()).toBeVisible()
    await expect(page.getByText('Gerada · referência enviada')).toBeVisible()
  })

  test('admin modera avaliação com dados privados e motivo opcional', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'admin-1', name: 'Admin EME', email: 'admin@eme.test', role: 'ADMIN' } } }))
    await page.route('**/api/admin/me', (route) => route.fulfill({ json: { profile: { id: 'admin-1', name: 'Admin EME', email: 'admin@eme.test', phone: '5554999990000' } } }))
    await page.route('**/api/admin/marketplace/reviews?status=PENDING_REVIEW', (route) => route.fulfill({ json: { reviews: [{ id: 'review-1', authorName: 'Cliente Avaliador', authorPhone: '54999999999', rating: 5, comment: 'Atendimento excelente e muito claro.', origin: 'PUBLIC_PROFILE', verified: false, attendanceConfirmed: true, status: 'PENDING_REVIEW', rejectionReason: null, createdAt: new Date().toISOString(), broker: { id: 'broker-1', catalogSlug: broker.slug, user: { name: broker.name } }, conversation: null, lead: null }] } }))
    let moderationPayload: unknown
    await page.route('**/api/admin/marketplace/reviews/review-1', async (route) => {
      moderationPayload = route.request().postDataJSON()
      await route.fulfill({ json: { review: { id: 'review-1', status: 'REJECTED' } } })
    })
    await page.goto('/admin/avaliacoes-marketplace')
    await expect(page.getByRole('heading', { name: /Cliente Avaliador/ })).toBeVisible()
    await expect(page.getByText('(54) 99999-9999')).toBeVisible()
    await expect(page.getByText('Sem vínculo automático')).toBeVisible()
    await page.getByRole('button', { name: 'Rejeitar' }).click()
    await page.getByPlaceholder('Motivo da rejeição (opcional)').fill('Não foi possível confirmar o atendimento.')
    await page.getByRole('button', { name: 'Confirmar rejeição' }).click()
    await expect.poll(() => moderationPayload).toEqual({ status: 'REJECTED', reason: 'Não foi possível confirmar o atendimento.' })
  })
})
