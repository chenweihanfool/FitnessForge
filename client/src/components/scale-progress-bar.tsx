type ScaleMarker = {
  value: number;
  label: string;
  colorClass: string;
  textColorClass: string;
};

type ScaleProgressBarProps = {
  currentValue: number;
  maxValue: number;
  markers?: ScaleMarker[];
  barColorClass?: string;
  height?: string;
  showLabels?: boolean;
  testId?: string;
};

export function ScaleProgressBar({
  currentValue,
  maxValue,
  markers = [],
  barColorClass,
  height = "h-2",
  showLabels = true,
  testId,
}: ScaleProgressBarProps) {
  const scale = maxValue > 0 ? maxValue * 1.1 : 100;
  const currentPercent = scale > 0 ? Math.min((currentValue / scale) * 100, 100) : 0;

  const avgMarker = markers.find(m => m.label === '均');
  const isAboveAverage = avgMarker ? currentValue >= avgMarker.value : true;
  const progressColor = barColorClass || (isAboveAverage ? 'bg-chart-3' : 'bg-destructive');

  return (
    <div className="space-y-1" data-testid={testId}>
      <div className={`relative ${height} bg-muted rounded-full overflow-visible`}>
        <div 
          className={`absolute left-0 top-0 h-full rounded-full ${progressColor} transition-all`}
          style={{ width: `${currentPercent}%` }}
        />
        
        {markers.map((marker, index) => {
          const markerPercent = scale > 0 ? Math.min((marker.value / scale) * 100, 100) : 0;
          if (markerPercent <= 0 || markerPercent > 100) return null;
          
          return (
            <div 
              key={index}
              className={`absolute top-0 h-full w-0.5 ${marker.colorClass} z-10`}
              style={{ left: `${markerPercent}%` }}
              title={`${marker.label}: ${marker.value.toFixed(1)}`}
            >
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap ${marker.textColorClass}`}>
                {marker.label}
              </div>
            </div>
          );
        })}
      </div>
      
      {showLabels && markers.length > 0 && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          {markers.map((marker, index) => (
            <span key={index} className={marker.textColorClass}>
              {marker.label}:{marker.value.toFixed(0)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
