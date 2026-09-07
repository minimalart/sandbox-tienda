import { Heading, Text } from "@medusajs/ui";
import TransferActions from "@modules/order/components/transfer-actions";
import TransferImage from "@modules/order/components/transfer-image";

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string };
}) {
  const { id, token } = params;

  return (
    <div className="mx-auto mt-10 mb-20 flex w-2/5 flex-col items-start gap-y-4">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        <Heading className="text-xl text-zinc-900" level="h1">
          Solicitud de transferencia del pedido {id}
        </Heading>
        <Text className="text-zinc-600">
          Recibiste una solicitud para transferir la titularidad de tu pedido (
          {id}). Si estás de acuerdo, podés aprobar la transferencia haciendo
          clic en el botón de abajo.
        </Text>
        <div className="h-px w-full bg-zinc-200" />
        <Text className="text-zinc-600">
          Si aceptás, el nuevo propietario asumirá todas las responsabilidades y
          permisos asociados a este pedido.
        </Text>
        <Text className="text-zinc-600">
          Si no reconocés esta solicitud o querés conservar la titularidad, no
          hace falta que hagas nada.
        </Text>
        <div className="h-px w-full bg-zinc-200" />
        <TransferActions id={id} token={token} />
      </div>
    </div>
  );
}
