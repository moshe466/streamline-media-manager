
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link as LinkIcon, Edit, Trash2 } from "lucide-react";
import { type QuickLink, getQuickLinks } from '@/services/quick-links';
import Link from 'next/link';

export function QuickLinksCard() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  
  useEffect(() => {
    getQuickLinks().then(setLinks);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <Button asChild variant="outline" size="sm">
                <Link href="/admin/links">
                    <Edit className="ml-2 h-4 w-4" />
                    ערוך קישורים
                </Link>
            </Button>
            <CardTitle className="text-lg">קישורים מהירים</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length > 0 ? links.map((link) => (
             <a 
                key={link.id} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-3 text-right">
                    <div>
                        <p className="font-semibold">{link.title}</p>
                        <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                    <div className="p-2 bg-background rounded-md">
                         <LinkIcon className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </a>
        )) : (
            <p className="text-center text-sm text-muted-foreground py-4">לא הוגדרו קישורים מהירים.</p>
        )}
      </CardContent>
    </Card>
  );
}
