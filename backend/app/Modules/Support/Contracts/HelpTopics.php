<?php

namespace App\Modules\Support\Contracts;

/** Help centre topics in the reader's language (S16.2); support tickets can point to one. */
interface HelpTopics
{
    /** @return array<int, array{id: int, slug: string, title: string, body: string, services: array, contexts: array}> */
    public function list(string $locale, ?string $service = null, ?string $context = null, ?string $q = null): array;

    public function find(string $slug, string $locale): ?array;
}
