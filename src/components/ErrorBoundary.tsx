import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0E131B] text-[#F1F5F9] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#161E29] border border-slate-400/15 rounded-2xl p-6 space-y-3 text-center">
            <h1 className="font-display text-lg font-bold text-white">
              Something went wrong
            </h1>
            <p className="text-xs text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-xs cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
