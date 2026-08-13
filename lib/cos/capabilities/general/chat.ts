import "server-only"

import {
  buildCosConversationResponse,
  classifyCosSocialIntent,
  COS_GENERAL_CHAT_OPTIONS,
} from "@/lib/cos/conversation"
import type { CosCapabilityHandler } from "@/lib/cos/types"

export const generalChatCapability: CosCapabilityHandler = async ({ message, context }) => {
  const socialIntent = classifyCosSocialIntent(message)

  return {
    response: buildCosConversationResponse({
      message,
      intent: socialIntent,
      firstName: context?.actor?.firstName,
      memory: context?.memory,
      workspace: context?.workspace,
    }),
    metadata: {
      noCharge: true,
      source: socialIntent ? "general_chat_social" : "general_chat",
      conversationKind: socialIntent ?? "general",
      options: [...COS_GENERAL_CHAT_OPTIONS],
    },
  }
}
