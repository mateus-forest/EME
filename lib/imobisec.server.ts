import "server-only"

import { validateCreciWithImobisec, type ImobisecCreciValidationInput } from "@/lib/imobisec-client"

export function validateBrokerCreci(input: ImobisecCreciValidationInput) {
  return validateCreciWithImobisec(input, {
    apiKey: process.env.IMOBISEC_API_KEY ?? "",
  })
}
