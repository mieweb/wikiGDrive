---
#layout: overridden inside /hugo/themes/wgd-bootstrap/layouts/index.html
title: WikiGDrive
raw_html: true
---

<div class="col-12 mt-5">
  <div class="container">
    <img src="/images/logo.svg" width="204" alt="Work in Progress Logo" class="d-block mx-auto mb-3 rounded rounded-3">
    <div class="col-md-8 mx-auto text-center">
      <h1 class="mb-4 fw-semibold">Google Drive to MarkDown synchronization</h1>
      <div class="lead mb-4">
        Transform Google Docs and Drawings into markdown, collaborate and create websites.
      </div>
      <div class="d-inline-flex mb-4 flex-wrap justify-content-center">
        <a class="btn btn-primary me-2 py-3 mb-2" href="/docs">
          <i class="fas fa-fw fa-book"></i> Introduction
        </a>
        <a class="btn btn-success me-2 py-3 mb-2" href="/docs/install">
          <i class="fas fa-fw fa-check-square"></i> Installation
        </a>
        <a class="btn btn-warning me-2 py-3 mb-2" href="https://wikigdrive.com">
          <i class="fas fa-fw fa-blog"></i> Demo Site
        </a>
      </div>
    </div>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4 py-5">
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-sync text-success"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Sync</h4>
          <p>Bidirectional Google Docs to markdown sync.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fa-brands fa-2x fa-fw fa-osi text-success"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Open source</h4>
          <p>Both SAS and Self-hosted.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-icons text-danger"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Diagrams</h4>
          <p>Convert Google Docs Drawings into SVG diagrams.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-puzzle-piece" style="color:#7633f9"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Docs widget</h4>
          <p>Additional docs sidebar and drive menu.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-search" style="color:#00008b"></i>
        </div>
        <div><h4 class="fw-bold mb-2">Search</h4>
          <p>Local search supported.</p></div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-grip-lines-vertical text-warning"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Hugo Pipes</h4>
          <p>Build site with the powerful Hugo pipes.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fab fa-2x fa-fw fa-sass" style="color:#c66394"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">SASS/SCSS</h4>
          <p>Custom theme and Bootstrap via SASS/SCSS variables.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fa-brands fa-2x fa-fw fa-git"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Git</h4>
          <p>Versioning with Git.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fa-brands fa-2x fa fa-github"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">GitHub</h4>
          <p>Push to github, create feature branches.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-code text-warning"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Markdown</h4>
          <p>Markdown preview.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-adjust"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Light/Dark Mode</h4>
          <p>Allow switching to light, dark or auto mode.</p>
        </div>
      </div>
      <div class="col d-flex align-items-start">
        <div class="bi text-muted flex-shrink-0 me-3">
          <i class="fas fa-2x fa-fw fa-gear text-success"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-2">Workflows</h4>
          <p>Trigger actions on Google Docs change.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<footer class="footer mt-auto py-3 text-center container">
  <div class="offcanvas offcanvas-bottom h-auto" tabindex="-1" id="offcanvasActionsPanel"
       aria-labelledby="offcanvasActionsPanelLabel">
    <div class="offcanvas-header">
      <div class="offcanvas-title h5" id="offcanvasActionsPanelLabel">
        <i class="fas fa-fw fa-th-large me-1"></i> Actions
      </div>
      <button type="button" class="btn-close ms-auto" data-bs-dismiss="offcanvas" data-bs-target="offcanvasActionsPanel"
              aria-label="Close"></button>
    </div>
  </div>
  <div class="row text-center">
    <div class="col-12 mt-2">
      <p class="mb-2">Google Drive to MarkDown synchronization</p>
      <p class="text-secondary mb-2">
        <small>
          Service and self-hosted Google Docs synchronization. It is used for blog and document sites typically.
        </small>
      </p>
      <div class="powered-by mb-2 text-secondary">
        <small>
          Build with ❤️ from the <a class="text-primary" href="https://gohugo.io" target="_blank" rel="noopener noreferrer">Hugo</a>
        </small>
      </div>
      <div class="justify-content-center mb-2 mt-3">
        <a class="nav-link social-link p-0 me-1 mb-2" target="_blank" href="https://github.com/mieweb/wikiGDrive/" title="GitHub" rel="me">
          <i class="fa-fw fa-2x fab fa-github"></i>
        </a>
      </div>
    </div>
  </div>
  <div class="sponsors">
    <a class="me-3" href="https://mieweb.com" target="_blank" rel="noopener noreferrer">
      <img
        class="bg-white px-2 border border-primary rounded"
        src="/images/mieLogo.svg"
        alt="Powered by Medical Informatics Engineering" width="114" height="51" loading="lazy">
    </a>
  </div>
</footer>
