declare const BrandImage: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    url: import("@medusajs/framework/utils").TextProperty;
    file_id: import("@medusajs/framework/utils").TextProperty;
    type: import("@medusajs/framework/utils").EnumProperty<["thumbnail", "image"]>;
    brand_id: import("@medusajs/framework/utils").TextProperty;
}>, "brand_image">;
export default BrandImage;
