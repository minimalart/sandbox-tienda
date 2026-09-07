"use client";

import {
  type CompanyAddress,
  type CompanyBilling,
  type CompanyMember,
  type CompanyRole,
  type MyCompany,
  inviteCompanyMember,
  removeCompanyMember,
  updateCompanyMember,
  updateMyCompany,
  uploadCompanyLogo,
} from "@lib/data/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormInput from "@modules/common/components/form-input";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import AddressFormWithMap, {
  type AddressFormData,
} from "@modules/common/components/address-form-with-map";
import PageHeader from "@modules/b2b/components/portal/page-header";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  buyer: "Comprador",
  viewer: "Lector",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  invited: "Invitado",
  disabled: "Inactivo",
};
const TAX_CONDITIONS = [
  { value: "responsable_inscripto", label: "Responsable Inscripto" },
  { value: "exento", label: "Exento" },
];
const ROLE_OPTIONS: Array<{ value: CompanyRole; label: string }> = [
  { value: "buyer", label: "Comprador" },
  { value: "admin", label: "Administrador" },
  { value: "viewer", label: "Lector" },
];
const normalizeInvoiceATaxCondition = (value?: string) =>
  value === "exento" ? "exento" : "responsable_inscripto";

const newAddressId = () =>
  `addr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** CompanyAddress → datos iniciales del formulario con mapa (para editar). */
const addrToFormData = (a: CompanyAddress): Partial<AddressFormData> => ({
  addressName: a.label,
  address1: a.address_line_1,
  address2: a.address_line_2 ?? "",
  city: a.city,
  province: a.province,
  postalCode: a.postal_code,
  phone: a.phone ?? "",
  latitude: a.lat != null && a.lat !== "" ? Number(a.lat) : null,
  longitude: a.lng != null && a.lng !== "" ? Number(a.lng) : null,
});

/** Datos del formulario con mapa → CompanyAddress (preservando id al editar). */
const formDataToAddr = (d: AddressFormData, id: string): CompanyAddress => ({
  id,
  label: d.addressName || d.address1,
  contact_name: [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || undefined,
  address_line_1: d.address1,
  address_line_2: d.address2 || undefined,
  city: d.city,
  province: d.province,
  postal_code: d.postalCode,
  phone: d.phone || undefined,
  lat: d.latitude != null ? String(d.latitude) : undefined,
  lng: d.longitude != null ? String(d.longitude) : undefined,
});

export default function CompanyUsers({
  data,
  googleMapsApiKey,
}: {
  data: MyCompany;
  googleMapsApiKey: string;
}) {
  const router = useRouter();
  const { company, role, members = [] } = data;
  const isManager = role === "owner" || role === "admin";
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  if (!company) return null;
  const metadata = (company.metadata ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Mi empresa" description="Datos y usuarios de tu empresa." />
        <Badge variant="secondary" className="mt-1 shrink-0">
          Tu rol: {ROLE_LABEL[role ?? ""] ?? role}
        </Badge>
      </div>
      {msg ? (
        <p className={`text-sm ${msg.type === "ok" ? "text-primary" : "text-destructive"}`}>{msg.text}</p>
      ) : null}

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          {isManager ? <TabsTrigger value="facturacion">Facturación</TabsTrigger> : null}
          {isManager ? <TabsTrigger value="direcciones">Direcciones</TabsTrigger> : null}
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <DatosTab company={company} isManager={isManager} flash={flash} onSaved={() => router.refresh()} />
        </TabsContent>

        {isManager ? (
          <TabsContent value="facturacion" className="mt-4">
            <FacturacionTab metadata={metadata} flash={flash} onSaved={() => router.refresh()} />
          </TabsContent>
        ) : null}

        {isManager ? (
          <TabsContent value="direcciones" className="mt-4">
            <DireccionesTab
              metadata={metadata}
              googleMapsApiKey={googleMapsApiKey}
              flash={flash}
              onSaved={() => router.refresh()}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="usuarios" className="mt-4">
          <UsuariosTab
            members={members}
            isManager={isManager}
            flash={flash}
            onChanged={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DatosTab({
  company,
  isManager,
  flash,
  onSaved,
}: {
  company: NonNullable<MyCompany["company"]>;
  isManager: boolean;
  flash: (t: "ok" | "err", m: string) => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: company.name ?? "",
    legal_name: company.legal_name ?? "",
    tax_id: company.tax_id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logo, setLogo] = useState<string | null>(
    ((company.metadata as Record<string, unknown> | null)?.logo as string) ?? null,
  );

  const onLogo = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const content = dataUrl.split(",")[1] ?? "";
      const r = await uploadCompanyLogo(file.name, file.type || "image/png", content);
      if (!r.ok) return flash("err", r.error);
      setLogo(r.url);
      flash("ok", "Logo actualizado.");
      onSaved();
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (f.name.trim().length < 2) return flash("err", "El nombre es obligatorio.");
    setBusy(true);
    const r = await updateMyCompany({
      name: f.name.trim(),
      legal_name: f.legal_name.trim() || null,
      tax_id: f.tax_id.trim() || null,
    });
    setBusy(false);
    if (!r.ok) return flash("err", r.error);
    flash("ok", "Datos actualizados.");
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Datos de la empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="size-full object-contain" />
            ) : (
              <Building2 className="size-6 text-muted-foreground" />
            )}
          </div>
          {isManager ? (
            <label className="cursor-pointer">
              <Button asChild variant="outline" size="sm">
                <span>{uploading ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}</span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLogo(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput label="Nombre" value={f.name} disabled={!isManager} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <FormInput label="Razón social" value={f.legal_name} disabled={!isManager} onChange={(e) => setF({ ...f, legal_name: e.target.value })} />
          <FormInput label="CUIT" placeholder="30-12345678-9" value={f.tax_id} disabled={!isManager} onChange={(e) => setF({ ...f, tax_id: e.target.value })} />
          <div className="flex items-end">
            <Badge
              variant="outline"
              className={
                company.status === "active"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-border bg-muted text-muted-foreground"
              }
            >
              {company.status}
            </Badge>
          </div>
        </div>
        {isManager ? (
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>Guardar</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FacturacionTab({
  metadata,
  flash,
  onSaved,
}: {
  metadata: Record<string, unknown>;
  flash: (t: "ok" | "err", m: string) => void;
  onSaved: () => void;
}) {
  const initial = (metadata.billing as CompanyBilling | undefined) ?? {};
  const [f, setF] = useState<CompanyBilling>({
    ...initial,
    tax_condition: normalizeInvoiceATaxCondition(initial.tax_condition),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CompanyBilling, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    const r = await updateMyCompany({ metadata: { ...metadata, billing: f } });
    setBusy(false);
    if (!r.ok) return flash("err", r.error);
    flash("ok", "Datos de facturación guardados.");
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Datos de facturación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput label="Razón social" value={f.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} />
          <FormInput label="CUIT" placeholder="30-12345678-9" value={f.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Condición frente al IVA</span>
            <ResponsiveCombobox
              placeholder="Condición frente al IVA"
              searchPlaceholder="Buscar condición..."
              value={normalizeInvoiceATaxCondition(f.tax_condition)}
              onValueChange={(value) =>
                set("tax_condition", normalizeInvoiceATaxCondition(value))
              }
              options={TAX_CONDITIONS}
            />
          </div>
          <FormInput label="Email de facturación" type="email" placeholder="facturacion@empresa.com" value={f.billing_email ?? ""} onChange={(e) => set("billing_email", e.target.value)} />
          <FormInput label="Teléfono" value={f.billing_phone ?? ""} onChange={(e) => set("billing_phone", e.target.value)} />
          <FormInput label="Domicilio fiscal" placeholder="Calle y número" value={f.address_line_1 ?? ""} onChange={(e) => set("address_line_1", e.target.value)} />
          <FormInput label="Localidad" value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          <FormInput label="Provincia" value={f.province ?? ""} onChange={(e) => set("province", e.target.value)} />
          <FormInput label="Código postal" value={f.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>Guardar facturación</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DireccionesTab({
  metadata,
  googleMapsApiKey,
  flash,
  onSaved,
}: {
  metadata: Record<string, unknown>;
  googleMapsApiKey: string;
  flash: (t: "ok" | "err", m: string) => void;
  onSaved: () => void;
}) {
  const addresses = (metadata.addresses as CompanyAddress[] | undefined) ?? [];
  // draft.id === "" → alta nueva; con id → edición de una existente.
  const [draft, setDraft] = useState<CompanyAddress | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = async (next: CompanyAddress[]) => {
    setBusy(true);
    const r = await updateMyCompany({ metadata: { ...metadata, addresses: next } });
    setBusy(false);
    return r;
  };

  const onSubmit = async (d: AddressFormData) => {
    const id = draft?.id || newAddressId();
    const addr = formDataToAddr(d, id);
    const exists = addresses.some((a) => a.id === id);
    const next = exists
      ? addresses.map((a) => (a.id === id ? addr : a))
      : [...addresses, addr];
    const r = await persist(next);
    if (!r.ok) return flash("err", r.error);
    setDraft(null);
    flash("ok", "Dirección guardada.");
    onSaved();
  };

  const onDelete = async (addr: CompanyAddress) => {
    const r = await persist(addresses.filter((a) => a.id !== addr.id));
    if (!r.ok) return flash("err", r.error);
    flash("ok", "Dirección eliminada.");
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Direcciones</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDraft({ id: "", label: "", address_line_1: "", city: "", province: "", postal_code: "" })}
        >
          <Plus className="size-4" /> Agregar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay direcciones.</p>
        ) : (
          <div className="space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.address_line_1, a.address_line_2, a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
                  </p>
                  {a.contact_name || a.phone ? (
                    <p className="text-xs text-muted-foreground">{[a.contact_name, a.phone].filter(Boolean).join(" · ")}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDraft(a)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(a)} disabled={busy}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal con mapa (mismo componente que el checkout B2B) */}
      <Dialog
        className="relative z-[10000]"
        onClose={() => {
          if (!busy) setDraft(null);
        }}
        open={!!draft}
      >
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <DialogTitle as="h3" className="mb-4 text-center font-semibold text-gray-900 text-lg">
                {draft?.id ? "Editar dirección" : "Agregar dirección"}
              </DialogTitle>
              {draft ? (
                <AddressFormWithMap
                  googleMapsApiKey={googleMapsApiKey}
                  hideNameFields
                  initialData={draft.id ? addrToFormData(draft) : { countryCode: "ar" }}
                  isLoading={busy}
                  onCancel={() => setDraft(null)}
                  onSubmit={onSubmit}
                  submitLabel="Guardar dirección"
                />
              ) : null}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

function UsuariosTab({
  members,
  isManager,
  flash,
  onChanged,
}: {
  members: CompanyMember[];
  isManager: boolean;
  flash: (t: "ok" | "err", m: string) => void;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("buyer");
  const [busy, setBusy] = useState(false);

  const onInvite = async () => {
    if (!/.+@.+\..+/.test(email)) return flash("err", "Email inválido.");
    setBusy(true);
    const res = await inviteCompanyMember(email, inviteRole);
    setBusy(false);
    if ("error" in res) return flash("err", res.error);
    setEmail("");
    flash("ok", "Invitación enviada. El usuario recibirá un link para sumarse.");
    onChanged();
  };

  return (
    <div className="space-y-5">
      {isManager ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invitar usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormInput
                className="flex-1"
                label="Email del usuario"
                placeholder="empleado@empresa.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <ResponsiveCombobox
                className="sm:w-44"
                placeholder="Rol"
                searchPlaceholder="Buscar rol..."
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as CompanyRole)}
                options={ROLE_OPTIONS}
              />
              <Button onClick={onInvite} disabled={busy}>Invitar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <CardHeader className="px-4 pb-3 pt-4">
          <CardTitle className="text-base">Usuarios</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {isManager ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  Sin usuarios.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-foreground">
                    {[m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "owner" ? "default" : "secondary"}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        m.status === "active"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {STATUS_LABEL[m.status] ?? m.status}
                    </Badge>
                  </TableCell>
                  {isManager ? (
                    <TableCell>
                      {m.role !== "owner" ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <ResponsiveCombobox
                            className="w-36"
                            placeholder="Rol"
                            searchPlaceholder="Buscar rol..."
                            value={m.role}
                            onValueChange={async (value) => {
                              const r = await updateCompanyMember(m.id, { role: value as CompanyRole });
                              if ("error" in r) flash("err", r.error);
                              else onChanged();
                            }}
                            triggerClassName="h-8"
                            options={ROLE_OPTIONS}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const r = await updateCompanyMember(m.id, {
                                status: m.status === "active" ? "disabled" : "active",
                              });
                              if ("error" in r) flash("err", r.error);
                              else onChanged();
                            }}
                          >
                            {m.status === "active" ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              const r = await removeCompanyMember(m.id);
                              if ("error" in r) flash("err", r.error);
                              else onChanged();
                            }}
                          >
                            Quitar
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
