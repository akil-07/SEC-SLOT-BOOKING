
export class Guide {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.overlay = null;
        this.tooltip = null;
        this.highlighter = null;

        this.init();
    }

    init() {
        // specific styles are in style.css
        this.createElements();
    }

    createElements() {
        // Highlighter (The "cutout" effect using box-shadow)
        this.highlighter = document.createElement('div');
        this.highlighter.className = 'guide-highlighter hidden';
        document.body.appendChild(this.highlighter);

        // Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'guide-tooltip hidden';
        this.tooltip.innerHTML = `
      <div class="guide-content">
        <h3 id="guide-title"></h3>
        <p id="guide-text"></p>
      </div>
      <div class="guide-controls">
        <button id="guide-skip" class="secondary-btn small">Skip</button>
        <div class="guide-nav">
          <span id="guide-progress"></span>
          <button id="guide-next" class="primary-btn small">Next</button>
        </div>
      </div>
    `;
        document.body.appendChild(this.tooltip);

        // Event Listeners
        document.getElementById('guide-next').addEventListener('click', () => this.nextStep());
        document.getElementById('guide-skip').addEventListener('click', () => this.end());

        // Resize handler to adjust highlighter
        window.addEventListener('resize', () => {
            if (!this.highlighter.classList.contains('hidden')) {
                const target = document.querySelector(this.steps[this.currentStep].element);
                if (target) {
                    this.positionHighlighter(target);
                    this.positionTooltip(target, this.steps[this.currentStep].position);
                }
            }
        });
    }

    start() {
        this.currentStep = 0;
        this.highlighter.classList.remove('hidden');
        this.tooltip.classList.remove('hidden');
        document.body.classList.add('guide-active'); // To disable scrolling if needed
        this.showStep();
    }

    showStep() {
        const step = this.steps[this.currentStep];
        const target = document.querySelector(step.element);

        if (!target) {
            // If element not found, skip or warn
            console.warn(`Guide: Element ${step.element} not found, skipping.`);
            this.nextStep();
            return;
        }

        // Scroll node into view
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update Content
        document.getElementById('guide-title').textContent = step.title;
        document.getElementById('guide-text').textContent = step.text;
        document.getElementById('guide-progress').textContent = `${this.currentStep + 1}/${this.steps.length}`;

        if (this.currentStep === this.steps.length - 1) {
            document.getElementById('guide-next').textContent = 'Finish';
        } else {
            document.getElementById('guide-next').textContent = 'Next';
        }

        // Position Highlighter after a slight delay to allow scroll to finish
        setTimeout(() => {
            this.positionHighlighter(target);
            this.positionTooltip(target, step.position || 'bottom');
        }, 300);
    }

    positionHighlighter(target) {
        const rect = target.getBoundingClientRect();
        const padding = 10; // Extra padding around the element

        this.highlighter.style.width = `${rect.width + padding * 2}px`;
        this.highlighter.style.height = `${rect.height + padding * 2}px`;
        this.highlighter.style.top = `${rect.top + window.scrollY - padding}px`;
        this.highlighter.style.left = `${rect.left + window.scrollX - padding}px`;
    }

    positionTooltip(target, position) {
        // We use the highlighter's rect for consistent spacing, but we could use target's rect too.
        // Highlighter is absolute positioned, but getBoundingClientRect returns VIEWPORT coords.
        const rect = this.highlighter.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const spacing = 15;

        // Viewport-relative coordinates
        let top, left;

        switch (position) {
            case 'bottom':
                top = rect.bottom + spacing;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'top':
                top = rect.top - tooltipRect.height - spacing;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.right + spacing;
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.left - tooltipRect.width - spacing;
                break;
            case 'center':
                top = (window.innerHeight - tooltipRect.height) / 2;
                left = (window.innerWidth - tooltipRect.width) / 2;
                break;
            default:
                top = rect.bottom + spacing;
                left = rect.left;
        }

        // Boundary checks (keep within VIEWPORT)
        const padding = 10;
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }

        // Vertical boundary checks
        if (top < padding) top = padding;
        // If it goes off bottom, maybe flip it? For now just clamp or let it be (scrolling handles bottom usually)

        // Apply SCROLL offset for Absolute positioning
        this.tooltip.style.top = `${top + window.scrollY}px`;
        this.tooltip.style.left = `${left + window.scrollX}px`;
    }

    nextStep() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.end();
        } else {
            this.showStep();
        }
    }

    end() {
        this.highlighter.classList.add('hidden');
        this.tooltip.classList.add('hidden');
        document.body.classList.remove('guide-active');
    }
}
