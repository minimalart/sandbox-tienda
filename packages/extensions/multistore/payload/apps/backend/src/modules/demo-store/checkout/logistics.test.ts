import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateShippingEligibility } from './runtime.ts';
const cart=()=>({items:[{requires_shipping:true,variant:{product:{shipping_profile:{id:'profile'}}}}],shipping_methods:[{shipping_option_id:'option',amount:10}],checkout_pickup:false,checkout_shipping_valid:false,checkout_pickup_only:false});
const option=()=>({id:'option',amount:10,shipping_profile_id:'profile',insufficient_inventory:false,data:{} as any});
describe('live logistics eligibility contracts',()=>{
 it('accepts a live matching option and price',()=>{const c=cart();evaluateShippingEligibility(c,[option()]);assert.equal(c.checkout_shipping_valid,true);});
 it('stock unavailability invalidates the selected option',()=>{const c=cart();evaluateShippingEligibility(c,[{...option(),insufficient_inventory:true}]);assert.equal(c.checkout_shipping_valid,false);});
 it('removing an option invalidates existing selection',()=>{const c=cart();evaluateShippingEligibility(c,[]);assert.equal(c.checkout_shipping_valid,false);});
 it('recomputed shipping price invalidates stale selection',()=>{const c=cart();evaluateShippingEligibility(c,[{...option(),amount:11}]);assert.equal(c.checkout_shipping_valid,false);});
 it('another shipping profile cannot cover the cart',()=>{const c=cart();evaluateShippingEligibility(c,[{...option(),shipping_profile_id:'other'}]);assert.equal(c.checkout_shipping_valid,false);});
 it('all physical profiles must be covered',()=>{const c=cart();c.items.push({requires_shipping:true,variant:{product:{shipping_profile:{id:'other'}}}});evaluateShippingEligibility(c,[option()]);assert.equal(c.checkout_shipping_valid,false);c.shipping_methods.push({shipping_option_id:'second',amount:5});evaluateShippingEligibility(c,[option(),{...option(),id:'second',amount:5,shipping_profile_id:'other'}]);assert.equal(c.checkout_shipping_valid,true);});
 it('digital items add no shipping profile requirement',()=>{const c=cart();c.items.push({requires_shipping:false,variant:{product:{shipping_profile:{id:'digital'}}}});evaluateShippingEligibility(c,[option()]);assert.equal(c.checkout_shipping_valid,true);});
 it('an absent branch cannot be forged by marking an option as pickup',()=>{const c=cart();evaluateShippingEligibility(c,[{...option(),data:{pickup_kind:'store'}}]);assert.equal(c.checkout_shipping_valid,false);assert.equal(c.checkout_pickup_only,true);});
 it('a verified branch allows pickup',()=>{const c=cart();c.checkout_pickup=true;evaluateShippingEligibility(c,[{...option(),data:{pickup_kind:'store'}}]);assert.equal(c.checkout_shipping_valid,true);});
 it('pickup-only choices permit asking for a branch instead of a home address',()=>{const c=cart();c.shipping_methods=[];evaluateShippingEligibility(c,[{...option(),data:{pickup_kind:'store'}},{...option(),id:'second',data:{pickup_kind:'store'}}]);assert.equal(c.checkout_pickup_only,true);assert.equal(c.checkout_shipping_valid,false);});
 it('mixed home delivery and pickup never imply pickup-only',()=>{const c=cart();evaluateShippingEligibility(c,[option(),{...option(),id:'pickup',data:{pickup_kind:'store'}}]);assert.equal(c.checkout_pickup_only,false);});
 it('empty availability never invents pickup',()=>{const c=cart();evaluateShippingEligibility(c,[]);assert.equal(c.checkout_pickup_only,false);});
});
