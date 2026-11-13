// Graphic id → component. The config refers to graphics by id (it stays free
// of React); tests/aeo-course.test.ts checks every id in it resolves here.

import type { ComponentType } from "react";
import type { AeoGraphicId } from "@/lib/aeo-course";
import { EngineMatrix, FanOut, SerpVsAnswer } from "./graphics-m1";
import { MrcaFunnel, PromptPanel } from "./graphics-m2";
import { CrawlerGate, CrawlerView, PageAnatomy } from "./graphics-m3";
import { EarnedRings, EvidenceMap } from "./graphics-m4";
import { DashboardMock, Roadmap90 } from "./graphics-m5";

export const AEO_GRAPHICS: Record<AeoGraphicId, ComponentType> = {
  "serp-vs-answer": SerpVsAnswer,
  "fan-out": FanOut,
  "engine-matrix": EngineMatrix,
  "prompt-panel": PromptPanel,
  "mrca-funnel": MrcaFunnel,
  "crawler-view": CrawlerView,
  "crawler-gate": CrawlerGate,
  "page-anatomy": PageAnatomy,
  "evidence-map": EvidenceMap,
  "earned-rings": EarnedRings,
  "dashboard-mock": DashboardMock,
  "roadmap-90": Roadmap90,
};

/** What each graphic animates, for the report and the test's coverage list. */
export const AEO_ANIMATIONS: Record<AeoGraphicId, string> = {
  "serp-vs-answer": "ten links collapse into one answer; three source chips pop in",
  "fan-out": "branches draw in (stroke-dashoffset, staggered); sources light up; lines converge",
  "engine-matrix": "rows fade in; tabbed engine switcher with crossfade",
  "prompt-panel": "cells fill in row by row",
  "mrca-funnel": "stages reveal in turn; a sample answer travels down and stops at Cited",
  "crawler-view": "wipe slider (range input) between rendered page and raw HTML",
  "crawler-gate": "bots move to the gate; allowed ones pass, blocked ones stop",
  "page-anatomy": "annotations pin on in sequence",
  "evidence-map": "lines draw, nodes pulse; one inconsistent node warns, then resolves",
  "earned-rings": "rings draw outward, labels pop",
  "dashboard-mock": "placeholder bars grow and a sparkline draws",
  "roadmap-90": "progress line advances; milestones pop",
};
