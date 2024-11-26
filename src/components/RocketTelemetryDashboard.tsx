'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

interface TelemetryData {
  timestamp: number;
  system_active: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  curr_alpha: number;
  curr_beta: number;
  vel_x: number;
  vel_y: number;
  vel_z: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  output_alpha: number;
  output_beta: number;
  servo1_pos: number;
  servo2_pos: number;
  inference_time_us: number;
}

interface MetricGroup {
  title: string;
  metrics: (keyof TelemetryData)[];
  colors: string[];
}

interface MetricChartProps {
  group: MetricGroup;
  data: TelemetryData[];
}

const START_TIME = 1009591.94;
const END_TIME = 1020308.51;

const RocketTelemetryDashboard: React.FC = () => {
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const processCSV = useCallback((csv: string): TelemetryData[] => {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    const processedData = lines.slice(1)
      .filter(line => line.trim() !== '')
      .map(line => {
        const values = line.split(',');
        const dataPoint: Partial<TelemetryData> = {};
        
        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          (dataPoint as any)[header] = isNaN(Number(value)) ? value : Number(value);
        });
        
        return dataPoint as TelemetryData;
      })
      .filter(d => d.timestamp >= START_TIME && d.timestamp <= END_TIME); // Filter for specific time range

    return processedData;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/telemetry');
        if (!response.ok) throw new Error('Failed to load telemetry data');
        const { data } = await response.json();
        const processed = processCSV(data);
        setTelemetryData(processed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [processCSV]);

  const metricGroups: Record<string, MetricGroup> = {
    acceleration: {
      title: 'Acceleration',
      metrics: ['accel_x', 'accel_y', 'accel_z'],
      colors: ['#8884d8', '#82ca9d', '#ffc658']
    },
    gyroscope: {
      title: 'Angular Velocity',
      metrics: ['gyro_x', 'gyro_y', 'gyro_z'],
      colors: ['#ff7300', '#00c49f', '#0088fe']
    },
    position: {
      title: '3D Position',
      metrics: ['pos_x', 'pos_y', 'pos_z'],
      colors: ['#413ea0', '#ff7300', '#00c49f']
    },
    velocity: {
      title: 'Velocity',
      metrics: ['vel_x', 'vel_y', 'vel_z'],
      colors: ['#8884d8', '#82ca9d', '#ffc658']
    },
    control: {
      title: 'Control Parameters',
      metrics: ['curr_alpha', 'curr_beta', 'output_alpha', 'output_beta'],
      colors: ['#8884d8', '#82ca9d', '#ff7300', '#00c49f']
    },
    servos: {
      title: 'Servo Positions',
      metrics: ['servo1_pos', 'servo2_pos'],
      colors: ['#8884d8', '#82ca9d']
    }
  };

  const formatTime = (time: number) => {
    return `T+${time.toFixed(2)}s`;
  };

  const MetricChart: React.FC<MetricChartProps> = ({ group, data }) => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                label={{ value: 'Time (s)', position: 'bottom' }}
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatTime}
              />
              <YAxis />
              <Tooltip labelFormatter={formatTime} />
              <Legend />
              {group.metrics.map((metric, index) => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={group.colors[index]}
                  name={metric}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  const PerformanceMetrics: React.FC<{ data: TelemetryData[] }> = ({ data }) => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>System Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTime}
              />
              <YAxis yAxisId="left" label={{ value: 'Inference Time (μs)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 1]} />
              <Tooltip labelFormatter={formatTime} />
              <Legend />
              <Bar dataKey="inference_time_us" fill="#8884d8" yAxisId="left" name="Inference Time" />
              <Line type="monotone" dataKey="system_active" stroke="#82ca9d" yAxisId="right" name="System Active" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  const getStatistics = useCallback((data: TelemetryData[]) => {
    if (!data.length) return null;
    
    const calculateStats = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)]
      };
    };

    return {
      flightTime: data[data.length - 1].timestamp - data[0].timestamp,
      maxAltitude: Math.max(...data.map(d => d.pos_z)),
      maxVelocity: Math.max(...data.map(d => Math.sqrt(d.vel_x ** 2 + d.vel_y ** 2 + d.vel_z ** 2))),
      inferenceStats: calculateStats(data.map(d => d.inference_time_us)),
      maxAcceleration: Math.max(...data.map(d => Math.sqrt(d.accel_x ** 2 + d.accel_y ** 2 + d.accel_z ** 2)))
    };
  }, []);

  const StatsCard: React.FC<{ data: TelemetryData[] }> = ({ data }) => {
    const stats = getStatistics(data);
    
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Flight Statistics ({formatTime(START_TIME)} to {formatTime(END_TIME)})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats && (
              <>
                <div>
                  <p className="font-semibold">Flight Time</p>
                  <p>{stats.flightTime.toFixed(2)}s</p>
                </div>
                <div>
                  <p className="font-semibold">Max Altitude</p>
                  <p>{stats.maxAltitude.toFixed(2)}m</p>
                </div>
                <div>
                  <p className="font-semibold">Max Velocity</p>
                  <p>{stats.maxVelocity.toFixed(2)}m/s</p>
                </div>
                <div>
                  <p className="font-semibold">Max Acceleration</p>
                  <p>{stats.maxAcceleration.toFixed(2)}m/s²</p>
                </div>
                <div>
                  <p className="font-semibold">Avg Inference Time</p>
                  <p>{stats.inferenceStats.avg.toFixed(2)}μs</p>
                </div>
                <div>
                  <p className="font-semibold">Max Inference Time</p>
                  <p>{stats.inferenceStats.max.toFixed(2)}μs</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Rocket Telemetry Analysis</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading telemetry data...</p>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-64 text-red-500">
          <p>{error}</p>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="motion">Motion</TabsTrigger>
            <TabsTrigger value="control">Control</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <StatsCard data={telemetryData} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricChart group={metricGroups.acceleration} data={telemetryData} />
              <MetricChart group={metricGroups.position} data={telemetryData} />
            </div>
          </TabsContent>

          <TabsContent value="motion" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricChart group={metricGroups.acceleration} data={telemetryData} />
              <MetricChart group={metricGroups.gyroscope} data={telemetryData} />
              <MetricChart group={metricGroups.velocity} data={telemetryData} />
              <MetricChart group={metricGroups.position} data={telemetryData} />
            </div>
          </TabsContent>

          <TabsContent value="control" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricChart group={metricGroups.control} data={telemetryData} />
              <MetricChart group={metricGroups.servos} data={telemetryData} />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceMetrics data={telemetryData} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default RocketTelemetryDashboard;