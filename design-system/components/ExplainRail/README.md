# Explain rail

The shared viewer opens Explain from More. The rail reserves a trailing column beside the document at widths of 768px and above. In a narrower viewer it fills the visible viewport, including when a software keyboard is open. The compact rail isolates background controls until the reader closes it or follows a source.

The header contains the title and Close button. A labeled source picker, preview or sequence walkthrough, coverage information and conversation share a single scrolling region. Source references use underlined accent text. The follow-up composer and active playback controls stay below the scrolling region. Surfaces, controls and dividers use the shared neutral and interaction tokens in both themes. The rail opens without animation.

Following a source on compact layouts exposes **Back to explanation**, which returns focus to the citation. Closing restores the reading position, selection and focus. The thread stays available for the same source and document revision.

Implementation: `markdown-viewer/src/features/explain-rail.js` and `explain-rail.css`.
