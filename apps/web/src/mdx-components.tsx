import type { MDXComponents } from "mdx/types";

// Required by @next/mdx. Styling comes from the .prose-docs wrapper in the docs layout.
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
	return components;
}
