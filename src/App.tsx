import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Index from "./pages/Index.tsx";
import LearningLab from "./pages/LearningLab.tsx";
import CircleTestPage from "./pages/CircleTestPage.tsx";
import OscilloscopePage from "./pages/OscilloscopePage.tsx";
import ScopeScratchPage from "./pages/ScopeScratchPage.tsx";
import GradientCurvePage from "./pages/GradientCurvePage.tsx";
import SandboxPage from "./pages/SandboxPage.tsx";
import PatchArticlePage from "./pages/PatchArticlePage.tsx";
import SearchPage from "./pages/SearchPage.tsx";
import ModulePage from "./pages/ModulePage.tsx";
import ModulesIndexPage from "./pages/ModulesIndexPage.tsx";
import EmbedPage from "./pages/EmbedPage.tsx";
import AVWResearch from "./pages/AVWResearch.tsx";
import WebringPage from "./pages/WebringPage.tsx";
import SupabaseTest from "./pages/SupabaseTest.tsx";
import SharePage from "./pages/SharePage.tsx";
import WikiPage from "./pages/WikiPage.tsx";
import WikiArticlePage from "./pages/WikiArticlePage.tsx";
import ChangelogPage from "./pages/ChangelogPage.tsx";
import UserPage from "./pages/UserPage.tsx";
import FilesPage from "./pages/FilesPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminClaims from "./pages/AdminClaims.tsx";
import AdminWikiEdits from "./pages/AdminWikiEdits.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import SelfPage from "./pages/SelfPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import { siteConfig } from "./config/site.ts";
import { RootSlugResolver, ShorthandHashCatcher, UserScopedRoute } from "./lib/routeResolver.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      {/* BrowserRouter is in main.tsx */}
      <ShorthandHashCatcher />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/learning-lab" element={<LearningLab />} />
        <Route path="/circle-test" element={<CircleTestPage />} />
        <Route path="/oscilloscope" element={<OscilloscopePage />} />
        <Route path="/scope-scratch" element={<ScopeScratchPage />} />
        <Route path="/gradient-curve" element={<GradientCurvePage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/self" element={<SelfPage />} />
        <Route path="/embed" element={<EmbedPage />} />

        {/* Embed-safe playable sandboxes: bare SandboxPage loading a static
            patch with audio armed. These back the snippets on /embed and must
            stay distinct from the article/patch routes in site.ts. */}
        <Route path="/reverb-live" element={<SandboxPage staticPatchUrl="/patches/reverb.json" autostart />} />
        <Route path="/silentlydreaming-live" element={<SandboxPage staticPatchUrl="/patches/silently-dreaming.json" autostart />} />
        <Route path="/shootingstar-live" element={<SandboxPage staticPatchUrl="/patches/shootingstar.json" autostart />} />

        {/* Named page patches live under the /patch namespace. A live sandbox
            bound to a URL; the owner can overwrite it from the toolbar.
            /patch/<slug>          -> showcase view (armed + framed)
            /patch/<slug>/sandbox  -> plain sandbox-only entry */}
        <Route path="/patch/:slug" element={<SandboxPage view="showcase" />} />
        <Route path="/patch/:slug/sandbox" element={<SandboxPage view="sandbox" />} />

        {/* User-owned namespace. Canonical forms carry a static `patch`/`wiki`
            segment so they rank above the generic /:handle/:bank routes.
            /@<user>/patch/<slug>  -> that user's patch in the sandbox
            /@<user>/wiki/<slug>   -> that user's wiki page
            Shorthand `~`/`#` forms are canonicalized in UserPage / the hash
            catcher. */}
        {/* React Router v6 only compiles `:name` as a param when the colon
            directly follows a slash, so `/@:handle` won't work. Match the
            whole segment as `:handle` (the `@` travels with it) and dispatch
            in a small guard — falls back to UserPage for legacy /user/patch/x
            style URLs where the bank happens to be named "patch" or "wiki". */}
        <Route
          path="/:handle/patch/:slug"
          element={
            <UserScopedRoute fallback={<UserPage />}>
              <SandboxPage view="showcase" scope="user" />
            </UserScopedRoute>
          }
        />
        <Route
          path="/:handle/wiki/:slug"
          element={
            <UserScopedRoute fallback={<UserPage />}>
              <WikiArticlePage />
            </UserScopedRoute>
          }
        />

        {/* Article, patch, front-page and redirect routes are all defined in
            src/config/site.ts — edit that file to add or change them. */}
        {Object.entries(siteConfig.articleRoutes).map(([path, slug]) => (
          <Route key={path} path={`/${path}`} element={<Index featuredSlug={slug} />} />
        ))}
        {Object.entries(siteConfig.patchRoutes).map(([path, slug]) => (
          <Route key={path} path={`/${path}`} element={<Index patchSlug={slug} />} />
        ))}
        {siteConfig.frontPageRoutes.map((path) => (
          <Route key={path} path={`/${path}`} element={<Index />} />
        ))}
        {Object.entries(siteConfig.redirects).map(([path, target]) => (
          <Route key={path} path={`/${path}`} element={<Navigate to={target} replace />} />
        ))}

        <Route path="/sandbox/:patch" element={<SandboxPage />} />
        <Route path="/sandbox/:user/:bank/:patch" element={<SandboxPage />} />
        {/* Site-wide search, and the pages it points at. */}
        <Route path="/search" element={<SearchPage />} />

        {/* Every module in the sandbox catalog gets a page of its own, and
            /modules lists all of them by department. */}
        <Route path="/modules" element={<ModulesIndexPage />} />
        <Route path="/module/:type" element={<ModulePage />} />

        {/* Patch wiki articles from src/data/patchArticles.ts. The older bare
            slugs (/sinewave, /polyblep, ...) still land on the front page via
            siteConfig.frontPageRoutes -- this namespace is additive. */}
        <Route path="/article/:slug" element={<PatchArticlePage />} />

        <Route path="/avw-research" element={<AVWResearch />} />
        <Route path="/webring" element={<WebringPage />} />
        <Route path="/supabase-test" element={<SupabaseTest />} />
        <Route path="/share/:slug" element={<SharePage />} />
        <Route path="/wiki" element={<WikiPage />} />
        <Route path="/wiki/:slug" element={<WikiArticlePage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/claims" element={<AdminClaims />} />
        <Route path="/admin/wiki" element={<AdminWikiEdits />} />
        <Route path="/admin/users" element={<AdminUsers />} />

        <Route path="/files" element={<FilesPage />} />
        <Route path="/:handle/files" element={<FilesPage />} />
        <Route path="/:handle/:bank/:patch" element={<UserPage />} />
        <Route path="/:handle/:bank" element={<UserPage />} />
        {/* Bare single segment: resolve sigils / legacy slugs / user handles. */}
        <Route path="/:handle" element={<RootSlugResolver />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
