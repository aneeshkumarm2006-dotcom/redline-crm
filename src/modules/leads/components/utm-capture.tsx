"use client";
import { useEffect } from "react";
import { rememberUtmSource } from "../utm";

/** Mounted in the public shell so a campaign landing on any public page is remembered for the inquiry form. */
export function UtmCapture() {
  useEffect(() => { rememberUtmSource(); }, []);
  return null;
}
