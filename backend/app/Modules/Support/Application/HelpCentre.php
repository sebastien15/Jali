<?php

namespace App\Modules\Support\Application;

use App\Models\ActivityLog;
use App\Models\HelpTopic;
use App\Models\User;
use App\Modules\Support\Contracts\HelpTopics;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Help centre (S16.2): localized topics for customers, written by admins in all 4 languages. */
class HelpCentre implements HelpTopics
{
    public const SERVICES = ['rides', 'hire', 'rental', 'shared', 'bus', 'cargo'];

    /** Published topics for a service (and optionally one context), in the reader's language. */
    public function list(string $locale, ?string $service = null, ?string $context = null, ?string $q = null): array
    {
        return HelpTopic::where('published', true)->orderBy('sort')->orderBy('id')->get()
            ->filter(fn (HelpTopic $t) => $service === null || $t->services === [] || in_array($service, $t->services, true))
            ->filter(fn (HelpTopic $t) => $context === null || in_array($context, $t->contexts ?? [], true))
            ->map(fn (HelpTopic $t) => self::localized($t, $locale))
            ->filter(fn (array $t) => $q === null || Str::contains(Str::lower($t['title'] . ' ' . $t['body']), Str::lower($q)))
            ->values()->all();
    }

    public function find(string $slug, string $locale): ?array
    {
        $topic = HelpTopic::where(['slug' => $slug, 'published' => true])->first();

        return $topic ? self::localized($topic, $locale) : null;
    }

    public static function localized(HelpTopic $t, string $locale): array
    {
        $pick = fn (array $text) => ($text[$locale] ?? '') !== '' ? $text[$locale] : ($text['en'] ?? '');

        return [
            'id' => $t->id, 'slug' => $t->slug, 'title' => $pick($t->title), 'body' => $pick($t->body),
            'services' => $t->services, 'contexts' => $t->contexts,
        ];
    }

    // ── Admin ────────────────────────────────────────────────────────────

    public static function rules(?HelpTopic $topic = null): array
    {
        $req = $topic ? 'sometimes' : 'required';

        return [
            'slug'       => [$req, 'string', 'max:80', 'regex:/^[a-z0-9-]+$/', Rule::unique('help_topics', 'slug')->ignore($topic?->id)],
            'title'      => [$req, 'array'],
            'title.en'   => ["required_with:title", 'string', 'max:120'],
            'title.fr'   => ["required_with:title", 'string', 'max:120'],
            'title.rw'   => ["required_with:title", 'string', 'max:120'],
            'title.sw'   => ["required_with:title", 'string', 'max:120'],
            'body'       => [$req, 'array'],
            'body.en'    => ["required_with:body", 'string', 'max:5000'],
            'body.fr'    => ["required_with:body", 'string', 'max:5000'],
            'body.rw'    => ["required_with:body", 'string', 'max:5000'],
            'body.sw'    => ["required_with:body", 'string', 'max:5000'],
            'services'   => 'sometimes|array',
            'services.*' => Rule::in(self::SERVICES),
            'contexts'   => 'sometimes|array',
            'contexts.*' => Rule::in(HelpTopic::CONTEXTS),
            'sort'       => 'sometimes|integer|min:0|max:10000',
            'published'  => 'sometimes|boolean',
        ];
    }

    public static function present(HelpTopic $t): array
    {
        return [
            'id' => $t->id, 'slug' => $t->slug, 'title' => $t->title, 'body' => $t->body, 'services' => $t->services,
            'contexts' => $t->contexts, 'sort' => $t->sort, 'published' => $t->published, 'updated_at' => $t->updated_at?->toIso8601String(),
        ];
    }

    public function save(?HelpTopic $topic, array $data, User $by): HelpTopic
    {
        $old = $topic ? self::present($topic) : null;
        $topic ??= new HelpTopic(['services' => [], 'contexts' => []]);
        $topic->fill(array_intersect_key($data, array_flip(['slug', 'title', 'body', 'services', 'contexts', 'sort', 'published'])));
        $topic->services = array_values(array_unique($topic->services ?? []));
        $topic->contexts = array_values(array_unique($topic->contexts ?? []));
        $topic->updated_by = $by->id;
        $topic->save();
        $this->log($by, $old ? 'help_topic_updated' : 'help_topic_created', $topic, $old);

        return $topic;
    }

    public function delete(HelpTopic $topic, User $by): void
    {
        $old = self::present($topic);
        $topic->delete();
        $this->log($by, 'help_topic_deleted', $topic, $old);
    }

    private function log(User $by, string $action, HelpTopic $topic, ?array $old): void
    {
        ActivityLog::create(['admin_id' => $by->id, 'action' => $action, 'entity_type' => 'help_topic', 'entity_id' => $topic->id,
            'details' => ['slug' => $topic->slug, 'old' => $old ? ['title' => $old['title']['en'] ?? null, 'published' => $old['published']] : null]]);
    }
}
