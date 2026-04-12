import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Link as LinkIcon, Edit, Trash2 } from "lucide-react";

// Placeholder data
const links = [
    { id: 1, name: "פורטל המדיה", url: "#" },
    { id: 2, name: "סטטוס שרתים", url: "#" },
    { id: 3, name: "דוחות שימוש", url: "#" },
];

export function QuickLinks() {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">קישורים מהירים</h2>
                <Button variant="outline">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    הוסף קישור
                </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {links.map(link => (
                    <Card key={link.id} className="bg-card">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <LinkIcon className="h-6 w-6 text-primary" />
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                                    {link.name}
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
