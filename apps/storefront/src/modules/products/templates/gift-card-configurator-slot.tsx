import type { HttpTypes } from '@medusajs/types'
import GiftCardConfigurator from '@modules/products/components/gift-card-configurator'

export const giftCardExperienceAvailable = true
export default function GiftCardConfiguratorSlot(props: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion; countryCode: string }) { return <GiftCardConfigurator {...props} /> }
