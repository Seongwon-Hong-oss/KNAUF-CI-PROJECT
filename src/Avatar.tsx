import { photoSrc } from "./photo";

export default function Avatar({
  name,
  path,
}: {
  name: string;
  path?: string | null;
}) {
  const src = photoSrc(path);
  return (
    <span className="avatar">
      {src ? <img src={src} alt="" loading="lazy" /> : name.slice(0, 1) || "?"}
    </span>
  );
}
