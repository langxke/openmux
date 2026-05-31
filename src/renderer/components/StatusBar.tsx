export function StatusBar() {
  return (
    <footer className="h-7 px-3 flex items-center justify-between border-t border-[#3b4261] bg-[#1a1b26] text-xs text-[#565f89] shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span>Glaze v0.1.0</span>
      </div>
      <div className="flex items-center gap-3">
        <span>Ctrl+P 命令面板</span>
        <span>Ctrl+B 侧边栏</span>
      </div>
    </footer>
  );
}
