// Loaded for every suite; the jest-dom matchers are only meaningful in the
// jsdom ones, but registering them unconditionally is cheaper than a second
// config and harmless under node.
import "@testing-library/jest-dom/vitest";
