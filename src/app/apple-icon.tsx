import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

function BrandGlyph() {
  return (
    <svg
      width="94"
      height="94"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.5 7.5C9.5 5.84315 10.8431 4.5 12.5 4.5C14.1569 4.5 15.5 5.84315 15.5 7.5C15.5 9.15685 14.1569 10.5 12.5 10.5C10.8431 10.5 9.5 9.15685 9.5 7.5Z"
        stroke="#292524"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 18.5C6.5 16.2909 8.29086 14.5 10.5 14.5H14C16.4853 14.5 18.5 12.4853 18.5 10V9"
        stroke="#292524"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 10.5H6.01" stroke="#292524" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 18H18.01" stroke="#292524" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 18H6.01" stroke="#292524" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 6H18.01" stroke="#292524" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7.2 10.8L9.8 9.3" stroke="#292524" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.2 9.3L16.8 7.8" stroke="#292524" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.4 16.6L6.9 17.5" stroke="#292524" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.2 15.8L17.4 17" stroke="#292524" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f4",
          borderRadius: 42,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(34,211,238,0.34) 0%, rgba(34,211,238,0) 45%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 28,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#06b6d4",
          }}
        />
        <BrandGlyph />
      </div>
    ),
    size
  );
}
