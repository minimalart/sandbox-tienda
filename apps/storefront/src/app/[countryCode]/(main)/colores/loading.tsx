export default function Loading() {
	return (
		<div className="content-container py-8">
			<div className="mb-6 space-y-2">
				<div className="h-7 w-48 animate-pulse rounded bg-ui-bg-subtle" />
				<div className="h-4 w-96 max-w-full animate-pulse rounded bg-ui-bg-subtle" />
			</div>
			<div className="mb-4 h-11 w-full animate-pulse rounded-lg bg-ui-bg-subtle" />
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: 18 }).map((_, i) => (
					<div className="h-14 animate-pulse rounded-lg bg-ui-bg-subtle" key={i} />
				))}
			</div>
		</div>
	);
}
