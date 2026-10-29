export default function RadarSweep() {
  return (
    <div className="radar-stage">
      <div className="radar">
        <div className="radar-cross-h" />
        <div className="radar-cross-v" />
        <div className="radar-sweep" />
        <span className="blip c1" />
        <span className="blip c2" />
        <span className="blip c3" />
      </div>
      <div className="radar-ring-dash" style={{ position: "absolute", width: "min(358px,70vw)", aspectRatio: "1", borderRadius: "50%" }} />
    </div>
  );
}
