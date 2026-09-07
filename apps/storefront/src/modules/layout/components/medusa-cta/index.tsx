import { Text } from "@medusajs/ui";

import Medusa from "../../../common/icons/medusa";
import NextJs from "../../../common/icons/nextjs";

const MedusaCTA = () => (
  <Text className="txt-compact-small-plus flex items-center gap-x-2">
    Powered by
    <a href="https://www.medusajs.com" rel="noreferrer" target="_blank">
      <Medusa className="fill-[#9ca3af]" fill="#9ca3af" />
    </a>
    &
    <a href="https://nextjs.org" rel="noreferrer" target="_blank">
      <NextJs fill="#9ca3af" />
    </a>
  </Text>
);

export default MedusaCTA;
