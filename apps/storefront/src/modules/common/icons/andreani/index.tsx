import Image from "next/image";

const Andreani = () => {
  return (
    <Image
      src="/andreanilogo.webp"
      alt="Andreani"
      width={40}
      height={40}
      className="object-contain"
    />
  );
};

export default Andreani;
