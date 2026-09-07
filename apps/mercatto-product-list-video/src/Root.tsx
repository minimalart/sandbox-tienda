import {Composition} from "remotion";
import {ProductListVideo} from "./ProductListVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="ProductListVideo"
      component={ProductListVideo}
      durationInFrames={1350}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
