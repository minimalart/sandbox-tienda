'use client';
export default function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div role="status" aria-live="polite" className="animate-in slide-in-from-bottom-2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
