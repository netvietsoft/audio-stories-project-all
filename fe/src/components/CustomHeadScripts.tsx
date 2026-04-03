'use client';

import { useEffect } from 'react';

export default function CustomHeadScripts() {
  useEffect(() => {
    const fetchAndInjectScripts = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/site`);
        const data = await response.json();
        
        if (data.custom_head_scripts && typeof data.custom_head_scripts === 'string') {
          // Create a temporary div to parse the HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.custom_head_scripts;
          
          // Extract and inject scripts
          const scripts = tempDiv.querySelectorAll('script');
          scripts.forEach((script) => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(script.attributes).forEach((attr) => {
              newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy inline script content
            if (script.innerHTML) {
              newScript.innerHTML = script.innerHTML;
            }
            
            // Append to head
            document.head.appendChild(newScript);
          });
          
          // Extract and inject other elements (like meta tags, link tags)
          const otherElements = tempDiv.querySelectorAll('meta, link, style');
          otherElements.forEach((element) => {
            const clonedElement = element.cloneNode(true);
            document.head.appendChild(clonedElement);
          });
        }
      } catch (error) {
        console.error('Failed to load custom head scripts:', error);
      }
    };

    fetchAndInjectScripts();
  }, []);

  return null;
}
