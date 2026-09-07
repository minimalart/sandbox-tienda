"use client";

import { useTenantChannel } from "@lib/site-config/context";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

interface ChannelConfig {
  salesChannelId: string;
  showSpecialPricing: boolean;
  showInventory: boolean;
  showLocations: boolean;
  customerGroupId?: string;
}

interface ChannelContextType {
  config: ChannelConfig;
  isLoading: boolean;
  updateConfig: (newConfig: Partial<ChannelConfig>) => void;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

interface ChannelProviderProps {
  children: React.ReactNode;
  salesChannelId?: string;
  customerGroupId?: string;
}

export const ChannelProvider = ({
  children,
  salesChannelId: propSalesChannelId,
  customerGroupId: propCustomerGroupId,
}: ChannelProviderProps) => {
  // Intentar obtener tenant del contexto (si está disponible)
  let tenantChannel;
  try {
    tenantChannel = useTenantChannel();
  } catch {
    // Si no hay TenantProvider, tenantChannel será undefined
    tenantChannel = undefined;
  }

  // Extraer valores primitivos para evitar recreaciones del objeto
  const tenantSalesChannelId = tenantChannel?.salesChannelId;
  const tenantCustomerGroupId = tenantChannel?.customerGroupId;

  // Prioridad: Tenant Config > Props > Env Var (fallback) > Default
  const salesChannelId =
    tenantSalesChannelId ||
    propSalesChannelId ||
    process.env.NEXT_PUBLIC_SALES_CHANNEL_ID ||
    "";

  const customerGroupId =
    tenantCustomerGroupId ||
    propCustomerGroupId ||
    process.env.NEXT_PUBLIC_CUSTOMER_GROUP_ID;

  const [config, setConfig] = useState<ChannelConfig>({
    salesChannelId,
    showSpecialPricing: true,
    showInventory: true,
    showLocations: false, // Desactivado - funcionalidad de geolocalización eliminada
    customerGroupId,
  });

  const updateConfig = (newConfig: Partial<ChannelConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  // Sincronizar config cuando cambian los valores del tenant
  // Usar valores primitivos en las dependencias para evitar bucles infinitos
  useEffect(() => {
    setConfig((prev) => {
      // Solo actualizar si los valores realmente cambiaron
      if (
        prev.salesChannelId !== salesChannelId ||
        prev.customerGroupId !== customerGroupId
      ) {
        return {
          ...prev,
          salesChannelId,
          customerGroupId,
        };
      }
      return prev;
    });
  }, [salesChannelId, customerGroupId]);

  return (
    <ChannelContext.Provider
      value={{
        config,
        isLoading: false, // Ya no hay carga de locaciones
        updateConfig,
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannel = () => {
  const context = useContext(ChannelContext);
  if (context === null) {
    throw new Error("useChannel must be used within a ChannelProvider");
  }
  return context;
};

/**
 * Like useChannel but returns null instead of throwing when used outside a
 * ChannelProvider (e.g. checkout/auth route groups). Lets shared client hooks
 * read the active channel defensively.
 */
export const useChannelSafe = (): ChannelContextType | null => {
  return useContext(ChannelContext);
};

// Hook para obtener configuración de precios del canal
export const useChannelPricing = () => {
  const { config } = useChannel();

  return {
    shouldShowSpecialPricing: config.showSpecialPricing,
    salesChannelId: config.salesChannelId,
    customerGroupId: config.customerGroupId,
  };
};

