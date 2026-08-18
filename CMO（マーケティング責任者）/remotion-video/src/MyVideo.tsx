import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {
  title: string;
  subtitle: string;
};

export const MyVideo: React.FC<Props> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const subtitleOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const bgShift = interpolate(frame, [0, 150], [0, 360]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${bgShift}deg, #0f172a 0%, #1e3a8a 50%, #7c3aed 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          transform: `scale(${titleScale})`,
          color: "white",
          fontSize: 140,
          fontWeight: 800,
          letterSpacing: -2,
          textShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          color: "#e0e7ff",
          fontSize: 60,
          marginTop: 24,
          fontWeight: 400,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
