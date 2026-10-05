import "@testing-library/jest-dom";

// Mantine's own documented jsdom setup — skipped components fail on the
// first render() otherwise. expertise-testing §2.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
window.HTMLElement.prototype.scrollIntoView = () => {};
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver as unknown as typeof window.ResizeObserver;
