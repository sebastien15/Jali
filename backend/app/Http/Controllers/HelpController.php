<?php

namespace App\Http\Controllers;

use App\Models\HelpTopic;
use App\Modules\Support\Application\HelpCentre;
use App\Modules\Support\Contracts\HelpTopics;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Help centre (S16.2): customer reads + admin writes. Validation and HTTP shape only. */
class HelpController extends Controller
{
    public function __construct(private readonly HelpCentre $help)
    {
    }

    /** GET /help/topics?service&context&q&locale */
    public function index(Request $request, HelpTopics $topics)
    {
        $data = $request->validate([
            'service' => ['sometimes', Rule::in(HelpCentre::SERVICES)],
            'context' => ['sometimes', Rule::in(HelpTopic::CONTEXTS)],
            'q'       => 'sometimes|string|max:80',
            'locale'  => ['sometimes', Rule::in(HelpTopic::LOCALES)],
        ]);

        return response()->json(['data' => $topics->list(self::locale($request), $data['service'] ?? null, $data['context'] ?? null, $data['q'] ?? null)]);
    }

    /** GET /help/topics/{slug} */
    public function show(Request $request, string $slug, HelpTopics $topics)
    {
        $topic = $topics->find($slug, self::locale($request));
        abort_unless($topic, 404, 'This help topic is not available.');

        return response()->json($topic);
    }

    /** GET /admin/help-topics — every language, drafts included */
    public function adminIndex()
    {
        return response()->json(['data' => HelpTopic::orderBy('sort')->orderBy('id')->get()->map(fn ($t) => HelpCentre::present($t))->all()]);
    }

    /** POST /admin/help-topics */
    public function store(Request $request)
    {
        $topic = $this->help->save(null, $request->validate(HelpCentre::rules()), $request->user());

        return response()->json(HelpCentre::present($topic), 201);
    }

    /** PUT /admin/help-topics/{id} */
    public function update(Request $request, int $id)
    {
        $topic = HelpTopic::findOrFail($id);
        $topic = $this->help->save($topic, $request->validate(HelpCentre::rules($topic)), $request->user());

        return response()->json(HelpCentre::present($topic));
    }

    /** DELETE /admin/help-topics/{id} */
    public function destroy(Request $request, int $id)
    {
        $this->help->delete(HelpTopic::findOrFail($id), $request->user());

        return response()->noContent();
    }

    /** ?locale, else Accept-Language, else English */
    private static function locale(Request $request): string
    {
        foreach ([$request->query('locale'), substr((string) $request->header('Accept-Language'), 0, 2)] as $l) {
            if (in_array($l, HelpTopic::LOCALES, true)) {
                return $l;
            }
        }

        return 'en';
    }
}
