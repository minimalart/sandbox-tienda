import type { HttpTypes } from "@medusajs/types";
import { Container } from "@medusajs/ui";
import Image from "next/image";

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[];
};

const ImageGallery = ({ images }: ImageGalleryProps) => (
  <div className="relative flex items-start">
    <div className="flex flex-1 flex-col gap-y-4 small:mx-16">
      {images.map((image, index) => (
        <Container
          className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
          id={image.id}
          key={image.id}
        >
          {!!image.url && (
            <Image
              alt={`Product image ${index + 1}`}
              className="absolute inset-0 rounded-rounded"
              fill
              priority={index <= 2 ? true : false}
              sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
              src={image.url}
              style={{
                objectFit: "cover",
              }}
            />
          )}
        </Container>
      ))}
    </div>
  </div>
);

export default ImageGallery;
