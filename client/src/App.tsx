import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import IDE from "./pages/IDE";
import { Provider as JotaiProvider } from "jotai";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/ide"} component={IDE} />
      <Route path={"/ide/:sessionId"} component={IDE} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <JotaiProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </JotaiProvider>
    </ErrorBoundary>
  );
}

export default App;
