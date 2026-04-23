"use client";

import React from "react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const childrenArray = React.Children.toArray(children);

    // Check if first child is a full-width hero section (has w-screen class)
    const firstChild = childrenArray[0];
    const isHeroSection = React.isValidElement(firstChild) &&
        typeof firstChild.type === 'string' &&
        firstChild.type === 'section' &&
        typeof firstChild.props === 'object' &&
        firstChild.props !== null &&
        'className' in firstChild.props &&
        typeof firstChild.props.className === 'string' &&
        firstChild.props.className.includes('w-screen');

    const restChildren = isHeroSection ? childrenArray.slice(1) : childrenArray;

    return (
        <main className="app-root-surface flex-1 w-full overflow-x-visible">
            {isHeroSection && firstChild}
            <div className="mx-auto w-full min-w-0 pb-32 px-4 sm:px-6 xl:max-w-[1400px] 2xl:w-[70vw] 2xl:max-w-[70vw] pt-2 md:py-8">
                {restChildren}
            </div>
        </main>
    );
}
