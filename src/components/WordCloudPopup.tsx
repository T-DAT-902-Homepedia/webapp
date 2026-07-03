import type { CityWordCloud, WordEntry } from "@/lib/parseAvis";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#f43f5e", "#14b8a6",
];

interface Props {
  city: CityWordCloud;
  onClose: () => void;
}

export default function WordCloudPopup({ city, onClose }: Props) {
  const words: WordEntry[] = city.words;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1000,
        background: "rgba(15,15,25,0.97)",
        borderRadius: 16,
        padding: "24px 28px",
        minWidth: 340,
        maxWidth: 520,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{city.nom_ville}</h2>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 12px",
          justifyContent: "center",
          padding: "8px 0",
          minHeight: 120,
        }}
      >
        {words.map(({ word, size }, i) => (
          <span
            key={word}
            style={{
              fontSize: size,
              color: COLORS[i % COLORS.length],
              fontWeight: size > 30 ? 700 : size > 20 ? 600 : 400,
              lineHeight: 1.2,
              cursor: "default",
            }}
          >
            {word}
          </span>
        ))}
      </div>

      <p style={{ margin: "12px 0 0", fontSize: 12, color: "#666", textAlign: "right" }}>
        Source : ville-ideale.fr
      </p>
    </div>
  );
}
