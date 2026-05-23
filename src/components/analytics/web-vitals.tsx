"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        name: "web_vital",
        value: {
          id: metric.id,
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
        },
      }),
    });
  });

  return null;
}
