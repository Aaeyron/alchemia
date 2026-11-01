// A polaroid-style photo taped onto the page, with a handwritten label underneath.

type PolaroidProps = {
  src: string;
  alt: string;
  label: string;
  tilt: string;
  tape?: string; // washi tape color class, e.g. "tape-pink"
};

export function Polaroid({ src, alt, label, tilt, tape = "tape-sky" }: PolaroidProps) {
  return (
    <figure className={`sticker relative bg-white p-3 pb-2 ${tilt}`}>
      {/* A strip of washi tape across the top edge */}
      <span aria-hidden="true" className={`washi ${tape} -top-3 left-1/2 -translate-x-1/2 -rotate-3`} />
      {/* A plain <img> is fine: the source is a data URL or a temporary API URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="aspect-square w-full rounded-control object-cover" />
      <figcaption className="caption mt-2 text-center">{label}</figcaption>
    </figure>
  );
}
