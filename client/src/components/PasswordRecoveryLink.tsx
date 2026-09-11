import { Button } from "@/components/ui/button";

export function PasswordRecoveryLink() {
  return (
    <Button asChild variant="link" className="w-full">
      <a href="https://docs.google.com/forms/d/e/1FAIpQLSceiedEceZeitmPLH6u1Y0ACQ_k-Hm7sgIgbbp2dZxY2ami-A/viewform?usp=header">
        パスワードを忘れた方
      </a>
    </Button>
  );
}
