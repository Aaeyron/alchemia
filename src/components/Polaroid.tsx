// A polaroid-style frame with a handwritten-ish label underneath.
export function Polaroid({ src, alt, label, tilt }: { src: string; alt: string; label: string; tilt: string }) {
  return (
    <figure className={`sticker bg-white p-3 pb-2 ${tilt}`}>
      {/* A plain <img> is fine: the source is a data URL or a temporary API URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="aspect-square w-full rounded-xl object-cover" />
      <figcaption className="mt-2 text-center text-lg font-semibold">{label}</figcaption>
    </figure>
  );
}
