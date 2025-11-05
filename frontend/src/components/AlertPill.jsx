export default function AlertPill({ severity = "info" }) {
  const map = {
    critico: { text: "Crítico", className: "bg-red-100 text-red-700" },
    alto:    { text: "Alto",    className: "bg-orange-100 text-orange-700" },
    medio:   { text: "Medio",   className: "bg-yellow-100 text-yellow-800" },
    bajo:    { text: "Bajo",    className: "bg-green-100 text-green-700" },
    info:    { text: "Info",    className: "bg-gray-100 text-gray-700" },
  };
  const opt = map[severity] || map.info;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${opt.className}`}>
      {opt.text}
    </span>
  );
}
