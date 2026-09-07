'use client';

import { getBannersForPlacement, sortBannersByPriority, type ApiBanner } from '@lib/banners';
import { createContext, useContext, useState } from 'react';

type BannersContextType = {
	banners: ApiBanner[];
	isLoading: boolean;
};

const BannersContext = createContext<BannersContextType>({
	banners: [],
	isLoading: true,
});

type BannersProviderProps = {
	children: React.ReactNode;
	initialBanners?: ApiBanner[];
};

export function BannersProvider({ children, initialBanners }: BannersProviderProps) {
	// El layout siempre pasa initialBanners desde getHomeBanners(); el fetch de
	// fallback fue eliminado — era código muerto (unreachable en producción).
	const [banners] = useState<ApiBanner[]>(initialBanners ?? []);
	const isLoading = false;

	return (
		<BannersContext.Provider value={{ banners: sortBannersByPriority(banners), isLoading }}>
			{children}
		</BannersContext.Provider>
	);
}

export function useBannersByPlacement(placement: string | string[]) {
	const { banners, isLoading } = useContext(BannersContext);
	const placements = Array.isArray(placement) ? placement : [placement];

	return {
		banners: sortBannersByPriority(
			placements.flatMap((currentPlacement) => getBannersForPlacement(banners, currentPlacement)),
		),
		isLoading,
	};
}
