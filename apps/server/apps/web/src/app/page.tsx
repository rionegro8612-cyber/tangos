import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-[430px] p-6 min-h-screen grid place-items-center">
      <div className="w-full space-y-4 text-center">
        <h1 className="text-2xl font-semibold">탱고</h1>
        <p className="text-gray-600">시니어 소셜 MVP</p>

        <Link
          href="/login"
          className="inline-block w-full rounded-lg bg-black text-white py-3"
        >
          휴대폰 번호로 로그인
        </Link>
      </div>
    </main>
  );
}
