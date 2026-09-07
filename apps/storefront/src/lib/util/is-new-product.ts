type ProductWithTags = {
  tags?: Array<{ id: string; value: string }> | null;
};

export function isNewProduct(product: ProductWithTags): boolean {
  return (
    product.tags?.some((tag) => tag.value.toLowerCase() === "nuevo") ?? false
  );
}
