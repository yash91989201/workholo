import { Link } from "@tanstack/react-router";
import { Button } from "@workholo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workholo/ui/components/card";

export default function Denied({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="container mx-auto max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login">
            <Button variant="outline">Switch account</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
