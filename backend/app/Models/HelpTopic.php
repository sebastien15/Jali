<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Help centre article in en/fr/rw/sw (S16.2) */
class HelpTopic extends Model
{
    public const LOCALES = ['en', 'fr', 'rw', 'sw'];
    public const CONTEXTS = ['charged_wrong', 'driver_behaviour', 'lost_item', 'safety', 'cancel', 'damage', 'payment', 'account', 'other'];

    protected $attributes = ['published' => true, 'sort' => 100];

    protected $fillable = ['slug', 'title', 'body', 'services', 'contexts', 'sort', 'published', 'updated_by'];

    protected function casts(): array
    {
        return ['title' => 'array', 'body' => 'array', 'services' => 'array', 'contexts' => 'array', 'published' => 'boolean', 'sort' => 'integer'];
    }
}
