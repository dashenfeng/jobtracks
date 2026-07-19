'use client';

import { Braces, KeyRound, GitCompare, Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonFormatter } from '@/components/features/json-tools/JsonFormatter';
import { JsonKeyConverter } from '@/components/features/json-tools/JsonKeyConverter';
import { JsonDiff } from '@/components/features/json-tools/JsonDiff';
import { JsonPathExtractor } from '@/components/features/json-tools/JsonPathExtractor';

export function JsonToolsClient() {
  return (
    <Tabs defaultValue="format" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="format" className="gap-2">
          <Braces className="size-4" />
          <span className="hidden sm:inline">格式化</span>
        </TabsTrigger>
        <TabsTrigger value="convert" className="gap-2">
          <KeyRound className="size-4" />
          <span className="hidden sm:inline">命名转换</span>
        </TabsTrigger>
        <TabsTrigger value="diff" className="gap-2">
          <GitCompare className="size-4" />
          <span className="hidden sm:inline">对比</span>
        </TabsTrigger>
        <TabsTrigger value="path" className="gap-2">
          <Search className="size-4" />
          <span className="hidden sm:inline">JSONPath</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="format">
        <Card>
          <CardContent className="p-6">
            <JsonFormatter />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="convert">
        <Card>
          <CardContent className="p-6">
            <JsonKeyConverter />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="diff">
        <Card>
          <CardContent className="p-6">
            <JsonDiff />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="path">
        <Card>
          <CardContent className="p-6">
            <JsonPathExtractor />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
