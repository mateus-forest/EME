"use client"

import { Bath, Bed, Car, ExternalLink, Flame, Heart, Search, Zap } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"

export function CatalogSection() {
  const properties = [
    {
      image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
      title: "Apartamento 2 quartos com suíte",
      location: "Porto Alegre - Bela Vista",
      price: "R$ 485.000",
      views: 47,
      interested: 8,
      bedrooms: 2,
      bathrooms: 2,
      parking: 1,
    },
    {
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
      title: "Casa 3 quartos com piscina",
      location: "Porto Alegre - Tristeza",
      price: "R$ 890.000",
      views: 32,
      interested: 5,
      bedrooms: 3,
      bathrooms: 3,
      parking: 2,
    },
    {
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
      title: "Cobertura duplex vista mar",
      location: "Torres - Centro",
      price: "R$ 1.250.000",
      views: 58,
      interested: 11,
      bedrooms: 4,
      bathrooms: 3,
      parking: 2,
    },
  ]

  return (
    <section id="produto" className="py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
              Catálogo{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C853] to-[#00E676]">
                inteligente
              </span>
              .
            </h2>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              Cada imóvel publicado entra automaticamente no seu catálogo inteligente.
              Compartilhe com clientes, WhatsApp e redes sociais enquanto o EME organiza tudo para você.
            </p>

            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
              <ExternalLink className="w-5 h-5 text-[#00C853]" />
              <span className="text-white font-medium">eme.app/</span>
              <span className="text-[#00C853] font-medium">seunome</span>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <Spinner className="size-4 text-[#00C853]" />
              <span className="text-sm text-white/50">Atualização em tempo real</span>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00C853]/20 to-transparent rounded-full blur-3xl opacity-50" />
            <div className="relative w-72 h-[600px] rounded-[40px] border-2 border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-3 shadow-2xl">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 rounded-full bg-white/10" />
              <div className="w-full h-full rounded-[32px] bg-[#0B0B0B] overflow-hidden pt-6">
                <div className="px-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center overflow-hidden">
                      <span className="text-base">EME</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Maria Santos</p>
                      <p className="text-[9px] text-white/50">CRECI 123456-F</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center" aria-label="Buscar">
                      <Search className="w-3.5 h-3.5 text-white/60" />
                    </button>
                    <button className="px-2.5 py-1 rounded-full bg-[#25D366] text-white text-[9px] font-semibold">
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="px-3 space-y-2 overflow-hidden">
                  {properties.map((property) => (
                    <div key={property.title} className="rounded-xl overflow-hidden relative">
                      <div className="relative h-24">
                        <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                            <Flame className="w-2.5 h-2.5 text-orange-400" />
                            <span className="text-[7px] text-white">Visto por {property.views}</span>
                          </div>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                            <Zap className="w-2.5 h-2.5 text-yellow-400" />
                            <span className="text-[7px] text-white">{property.interested} interessados</span>
                          </div>
                        </div>
                        <button className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center" aria-label="Favoritar">
                          <Heart className="w-2.5 h-2.5 text-white" />
                        </button>
                        <div className="absolute bottom-1.5 left-1.5">
                          <p className="text-xs font-bold text-white">{property.price}</p>
                        </div>
                      </div>

                      <div className="bg-[#111] px-2.5 py-2">
                        <p className="text-[10px] font-medium text-white leading-tight">{property.title}</p>
                        <p className="text-[8px] text-white/40 mt-0.5">{property.location}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1">
                            <Bed className="w-2.5 h-2.5 text-white/40" />
                            <span className="text-[8px] text-white/50">{property.bedrooms}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bath className="w-2.5 h-2.5 text-white/40" />
                            <span className="text-[8px] text-white/50">{property.bathrooms}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Car className="w-2.5 h-2.5 text-white/40" />
                            <span className="text-[8px] text-white/50">{property.parking}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
